import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatDateForDisplay } from '@/utils/dateUtils';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  User,
  Bell,
  Shield,
  Palette,
  Save,
  AlertTriangle,
  Eye,
  EyeOff
} from 'lucide-react';

export function Settings() {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Profile form states
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.date_of_birth || '');
  const [alternateContactNo, setAlternateContactNo] = useState(user?.alternate_contact_no || '');
  const [permanentAddress, setPermanentAddress] = useState(user?.permanent_address || '');
  const [qualification, setQualification] = useState(user?.qualification || '');

  // Password form states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Notification preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [leaveReminders, setLeaveReminders] = useState(true);
  const [performanceUpdates, setPerformanceUpdates] = useState(true);
  const [systemAnnouncements, setSystemAnnouncements] = useState(true);

  // Appearance preferences
  const [theme, setTheme] = useState('system');
  const [language, setLanguage] = useState('en');
  const [timezone, setTimezone] = useState('America/New_York');

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSaving(true);

    try {
      const updates = {
        full_name: fullName,
        phone: phone,
        address: address,
        date_of_birth: dateOfBirth,
        alternate_contact_no: alternateContactNo,
        permanent_address: permanentAddress,
        qualification: qualification,
      };
      await authApi.updateProfile(user.id, updates);
      
      // Update local user state
      await updateUser(updates);
      
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error('Failed to update profile');
      console.error('Profile update error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    setIsSaving(true);
    try {
      await authApi.updateProfile(user.id, {
        password_hash: btoa(newPassword) // Simple encoding for demo
      });
      
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      toast.success('Password changed successfully!');
    } catch (error) {
      toast.error('Failed to change password');
      console.error('Password change error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotificationSave = async () => {
    setIsSaving(true);
    try {
      if (!user) return;
      
      await authApi.updateProfile(user.id, {
        extra_permissions: {
          ...user.extra_permissions,
          notifications: {
            email: emailNotifications,
            leave_reminders: leaveReminders,
            performance_updates: performanceUpdates,
            system_announcements: systemAnnouncements
          }
        }
      });
      
      toast.success('Notification preferences saved!');
    } catch (error) {
      toast.error('Failed to save preferences');
      console.error('Notification preferences error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAppearanceSave = async () => {
    setIsSaving(true);
    try {
      if (!user) return;
      
      await authApi.updateProfile(user.id, {
        extra_permissions: {
          ...user.extra_permissions,
          preferences: {
            theme,
            language,
            timezone
          }
        }
      });
      
      toast.success('Appearance preferences saved!');
    } catch (error) {
      toast.error('Failed to save preferences');
      console.error('Appearance preferences error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="profile">Profile</TabsTrigger> 
          {/* <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger> */}
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Personal Information
                  </CardTitle>
                  <CardDescription>
                    Update your personal details and contact information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form key={isEditing ? 'editing' : 'readonly'} onSubmit={handleProfileSave} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                          id="fullName"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          disabled={!isEditing}
                          className="mt-1"
                          autoFocus={isEditing}
                        />
                      </div>

                      <div>
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          value={user?.email || ''}
                          disabled
                          className="mt-1 bg-muted"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Email cannot be changed
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                          id="phone"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          disabled={!isEditing}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="alternateContactNo">Alternate Contact No.</Label>
                        <Input
                          id="alternateContactNo"
                          value={alternateContactNo}
                          onChange={(e) => setAlternateContactNo(e.target.value)}
                          disabled={!isEditing}
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label htmlFor="dateOfBirth">Date of Birth</Label>
                        <Input
                          id="dateOfBirth"
                          type="date"
                          value={dateOfBirth}
                          onChange={(e) => setDateOfBirth(e.target.value)}
                          disabled={!isEditing}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="address">Current Address</Label>
                      <Textarea
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        disabled={!isEditing}
                        className="mt-1"
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="permanentAddress">Permanent Address</Label>
                      <Textarea
                        id="permanentAddress"
                        value={permanentAddress}
                        onChange={(e) => setPermanentAddress(e.target.value)}
                        disabled={!isEditing}
                        className="mt-1"
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="qualification">Qualification</Label>
                      <Textarea
                        id="qualification"
                        value={qualification}
                        onChange={(e) => setQualification(e.target.value)}
                        disabled={!isEditing}
                        className="mt-1"
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-3">
                      {!isEditing ? (
                        <Button type="button" onClick={() => setIsEditing(true)}>
                          Edit Profile
                        </Button>
                      ) : (
                        <>
                          <Button type="submit" disabled={isSaving || !isEditing}>
                            <Save className="h-4 w-4 mr-2" />
                            {isSaving && <LoadingSpinner size="sm" className="mr-2" />}
                            {isSaving ? 'Saving...' : 'Save Changes'}
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            disabled={isSaving}
                            onClick={() => {
                              setIsEditing(false);
                              // Reset form values
                              setFullName(user?.full_name || '');
                              setPhone(user?.phone || '');
                              setAddress(user?.address || '');
                              setDateOfBirth(user?.date_of_birth || '');
                              setAlternateContactNo(user?.alternate_contact_no || '');
                              setPermanentAddress(user?.permanent_address || '');
                              setQualification(user?.qualification || '');
                            }}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {/* <Card>
                <CardHeader>
                  <CardTitle>Profile Picture</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center space-y-4">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={user?.avatar_url} />
                    <AvatarFallback className="text-lg">
                      {user?.full_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  {/* <Button size="sm" variant="outline">
                    <Camera className="h-4 w-4 mr-2" />
                    Change Photo
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    JPG, PNG or GIF. Max size 2MB.
                  </p>
                </CardContent>
              </Card> */}

              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Employee ID:</span>
                    <span className="font-medium">{user?.employee_id || 'Not assigned'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role:</span>
                    <span className="font-medium capitalize">{user?.role?.name?.replace('_', ' ') || 'Not assigned'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Department:</span>
                    <span className="font-medium">{user?.department?.name || 'Not assigned'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Joining Date:</span>
                    <span className="font-medium">{user?.date_of_joining ? formatDateForDisplay(user.date_of_joining, 'PPP') : 'Not set'}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Work Information</CardTitle>
              <CardDescription>Your employment details (read-only).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">Position</p>
                  <p className="text-muted-foreground">{user?.position || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-medium">Designation (Offer Letter)</p>
                  <p className="text-muted-foreground">{user?.designation_offer_letter || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-medium">Level/Grade</p>
                  <p className="text-muted-foreground">{user?.level_grade || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-medium">Employment Terms</p>
                  <p className="text-muted-foreground capitalize">{user?.employment_terms?.replace('_', ' ') || 'N/A'}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="font-medium">Skills</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {user?.skill && user.skill.length > 0 ? user.skill.map((s, i) => (
                      <Badge key={i} variant="secondary">{s}</Badge>
                    )) : <p className="text-muted-foreground">No skills listed</p>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
              <CardDescription>Other personal and financial details (read-only).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <h4 className="md:col-span-2 font-semibold text-base">Personal Details</h4>
                <div>
                  <p className="font-medium">Gender</p>
                  <p className="text-muted-foreground capitalize">{user?.gender?.replace('_', ' ') || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-medium">Blood Group</p>
                  <p className="text-muted-foreground">{user?.blood_group || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-medium">Religion</p>
                  <p className="text-muted-foreground">{user?.religion || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-medium">Marital Status</p>
                  <p className="text-muted-foreground capitalize">{user?.marital_status || 'N/A'}</p>
                </div>
                {user?.marital_status === 'married' && user?.date_of_marriage_anniversary && (
                  <div>
                    <p className="font-medium">Marriage Anniversary</p>
                    <p className="text-muted-foreground">{formatDateForDisplay(user.date_of_marriage_anniversary, 'PPP')}</p>
                  </div>
                )}

                <h4 className="md:col-span-2 font-semibold text-base pt-4 border-t">Family Details</h4>
                <div>
                  <p className="font-medium">Father's Name</p>
                  <p className="text-muted-foreground">{user?.father_name || 'N/A'}</p>
                </div>
                {user?.father_dob && (
                  <div>
                    <p className="font-medium">Father's Date of Birth</p>
                    <p className="text-muted-foreground">{formatDateForDisplay(user.father_dob, 'PPP')}</p>
                  </div>
                )}
                <div>
                  <p className="font-medium">Mother's Name</p>
                  <p className="text-muted-foreground">{user?.mother_name || 'N/A'}</p>
                </div>
                {user?.mother_dob && (
                  <div>
                    <p className="font-medium">Mother's Date of Birth</p>
                    <p className="text-muted-foreground">{formatDateForDisplay(user.mother_dob, 'PPP')}</p>
                  </div>
                )}

                <h4 className="md:col-span-2 font-semibold text-base pt-4 border-t">Identity & Financial Details</h4>
                <div>
                  <p className="font-medium">Personal Email</p>
                  <p className="text-muted-foreground">{user?.personal_email || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-medium">Aadhar Card No.</p>
                  <p className="text-muted-foreground">{user?.aadhar_card_no || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-medium">PAN No.</p>
                  <p className="text-muted-foreground">{user?.pan_no || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-medium">Bank Account No.</p>
                  <p className="text-muted-foreground">{user?.bank_account_no || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-medium">IFSC Code</p>
                  <p className="text-muted-foreground">{user?.ifsc_code || 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Password must be at least 8 characters long and contain a mix of letters, numbers, and symbols.
                  </AlertDescription>
                </Alert>

                <Button type="submit" disabled={isSaving}>
                  {isSaving && <LoadingSpinner size="sm" className="mr-2" />}
                  {isSaving ? 'Changing Password...' : 'Change Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose how you want to receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="emailNotifications">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                  <Switch
                    id="emailNotifications"
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="leaveReminders">Leave Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Reminders about leave applications and approvals
                    </p>
                  </div>
                  <Switch
                    id="leaveReminders"
                    checked={leaveReminders}
                    onCheckedChange={setLeaveReminders}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="performanceUpdates">Performance Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Updates about goals, evaluations, and feedback
                    </p>
                  </div>
                  <Switch
                    id="performanceUpdates"
                    checked={performanceUpdates}
                    onCheckedChange={setPerformanceUpdates}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="systemAnnouncements">System Announcements</Label>
                    <p className="text-sm text-muted-foreground">
                      Important system updates and announcements
                    </p>
                  </div>
                  <Switch
                    id="systemAnnouncements"
                    checked={systemAnnouncements}
                    onCheckedChange={setSystemAnnouncements}
                  />
                </div>
              </div>

              <Button onClick={handleNotificationSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving && <LoadingSpinner size="sm" className="mr-2" />}
                {isSaving ? 'Saving...' : 'Save Preferences'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance & Language
              </CardTitle>
              <CardDescription>
                Customize how the application looks and feels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="theme">Theme</Label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="language">Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Chicago">Central Time</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={handleAppearanceSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving && <LoadingSpinner size="sm" className="mr-2" />}
                {isSaving ? 'Saving...' : 'Save Preferences'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}