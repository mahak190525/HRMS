import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { emailApi } from '@/services/emailApi';
import { Loader2, Mail, TestTube, ListEnd, RefreshCw } from 'lucide-react';

export function EmailTestComponent() {
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [isTestingLeaveEmail, setIsTestingLeaveEmail] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('');
  const [leaveApplicationId, setLeaveApplicationId] = useState('');
  const [queueStats, setQueueStats] = useState({ pending: 0, sent: 0, failed: 0 });
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  const handleTestEmail = async () => {
    if (!testEmail || !testName) {
      toast.error('Please enter both email and name');
      return;
    }

    setIsTestingEmail(true);
    try {
      await emailApi.testEmail({
        email: testEmail,
        name: testName,
      });
      toast.success('Test email sent successfully!');
    } catch (error: any) {
      toast.error(`Failed to send test email: ${error.message}`);
      console.error('Test email error:', error);
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleTestLeaveEmail = async () => {
    if (!leaveApplicationId) {
      toast.error('Please enter a leave application ID');
      return;
    }

    setIsTestingLeaveEmail(true);
    try {
      await emailApi.sendLeaveApprovalEmails(leaveApplicationId);
      toast.success('Leave approval emails sent successfully!');
      loadQueueStats(); // Refresh stats after sending
    } catch (error: any) {
      toast.error(`Failed to send leave approval emails: ${error.message}`);
      console.error('Leave email error:', error);
    } finally {
      setIsTestingLeaveEmail(false);
    }
  };

  const loadQueueStats = async () => {
    setIsLoadingStats(true);
    try {
      const stats = await emailApi.getEmailQueueStats();
      setQueueStats(stats);
    } catch (error) {
      console.error('Failed to load queue stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleProcessQueue = async () => {
    try {
      await emailApi.processEmailQueue();
      toast.success('Email queue processing triggered!');
      loadQueueStats(); // Refresh stats after processing
    } catch (error: any) {
      toast.error(`Failed to process queue: ${error.message}`);
      console.error('Queue processing error:', error);
    }
  };

  // Load stats on component mount
  useEffect(() => {
    loadQueueStats();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Service Test
          </CardTitle>
          <CardDescription>
            Test the Microsoft Graph email integration to ensure it's working correctly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="test-email">Test Email Address</Label>
              <Input
                id="test-email"
                type="email"
                placeholder="test@example.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-name">Recipient Name</Label>
              <Input
                id="test-name"
                placeholder="John Doe"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
              />
            </div>
          </div>
          <Button 
            onClick={handleTestEmail} 
            disabled={isTestingEmail || !testEmail || !testName}
            className="w-full"
          >
            {isTestingEmail ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Test Email...
              </>
            ) : (
              <>
                <TestTube className="mr-2 h-4 w-4" />
                Send Test Email
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Leave Approval Email Test
          </CardTitle>
          <CardDescription>
            Test leave approval email notifications using an existing approved leave application ID.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="leave-app-id">Leave Application ID</Label>
            <Input
              id="leave-app-id"
              placeholder="Enter leave application UUID"
              value={leaveApplicationId}
              onChange={(e) => setLeaveApplicationId(e.target.value)}
            />
          </div>
          <Button 
            onClick={handleTestLeaveEmail} 
            disabled={isTestingLeaveEmail || !leaveApplicationId}
            className="w-full"
          >
            {isTestingLeaveEmail ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Leave Emails...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Leave Approval Emails
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListEnd className="h-5 w-5" />
            Email Queue Monitor
          </CardTitle>
          <CardDescription>
            Monitor the email queue status and manually process pending emails.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  Pending: {queueStats.pending}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Sent: {queueStats.sent}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-red-100 text-red-800">
                  Failed: {queueStats.failed}
                </Badge>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadQueueStats}
              disabled={isLoadingStats}
            >
              {isLoadingStats ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleProcessQueue}
              variant="outline"
              className="flex-1"
            >
              <ListEnd className="mr-2 h-4 w-4" />
              Process Queue Now
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>• The email queue processes automatically every 15 seconds</p>
            <p>• Use "Process Queue Now" to trigger immediate processing</p>
            <p>• Pending emails are queued when leaves are approved</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="text-amber-800">Important Notes</CardTitle>
        </CardHeader>
        <CardContent className="text-amber-700 space-y-2">
          <p>• Make sure the Azure app has the correct permissions (Mail.Send and User.Read)</p>
          <p>• The sender email (hrms@mechlintech.com) must exist in your Microsoft 365 tenant</p>
          <p>• For leave approval emails, use an existing approved leave application ID</p>
          <p>• Check the browser console for detailed error messages if emails fail</p>
        </CardContent>
      </Card>
    </div>
  );
}

