import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginForm } from '@/components/auth/LoginForm';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { Toaster } from 'sonner';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { blockPrinting, initializePrintBlocking } from '@/utils/printBlocker';

// Lazy load components for better performance
const DashboardOverview = lazy(() => import('@/pages/dashboard/DashboardOverview').then(m => ({ default: m.DashboardOverview })));
const LeaveApplication = lazy(() => import('@/pages/dashboard/LeaveApplication').then(m => ({ default: m.LeaveApplication })));
const Documents = lazy(() => import('@/pages/dashboard/Documents').then(m => ({ default: m.Documents })));
const Assets = lazy(() => import('@/pages/dashboard/Assets').then(m => ({ default: m.Assets })));
const Policies = lazy(() => import('@/pages/dashboard/Policies').then(m => ({ default: m.Policies })));
const Complaints = lazy(() => import('@/pages/dashboard/Complaints').then(m => ({ default: m.Complaints })));
const Performance = lazy(() => import('@/pages/dashboard/Performance').then(m => ({ default: m.Performance })));
const HRMSFeedback = lazy(() => import('@/pages/dashboard/HRMSFeedback').then(m => ({ default: m.HRMSFeedback })));
const KRA = lazy(() => import('@/pages/performance/KRA').then(m => ({ default: m.KRA })));
const KRATemplatePage = lazy(() => import('@/pages/performance/KRATemplatePage').then(m => ({ default: m.KRATemplatePage })));
const KRADetailsPage = lazy(() => import('@/pages/performance/KRADetailsPage').then(m => ({ default: m.KRADetailsPage })));
const MyKRAPage = lazy(() => import('@/pages/employees/MyKRAPage').then(m => ({ default: m.MyKRAPage })));
const ManagerKRAPage = lazy(() => import('@/pages/performance/ManagerKRAPage').then(m => ({ default: m.ManagerKRAPage })));
const PerformanceOverview = lazy(() => import('@/pages/performance/PerformanceOverview').then(m => ({ default: m.PerformanceOverview })));
const ReferSomeone = lazy(() => import('@/pages/dashboard/ReferSomeone').then(m => ({ default: m.ReferSomeone })));
const Settings = lazy(() => import('@/pages/dashboard/Settings').then(m => ({ default: m.Settings })));
const EmployeeManagement = lazy(() => import('@/pages/employees/EmployeeManagement').then(m => ({ default: m.EmployeeManagement })));
const LeaveManagement = lazy(() => import('@/pages/employees/LeaveManagement').then(m => ({ default: m.LeaveManagement })));
const AssetManagement = lazy(() => import('@/pages/employees/AssetManagement').then(m => ({ default: m.AssetManagement })));
const ReferralDashboard = lazy(() => import('@/pages/employees/ReferralDashboard').then(m => ({ default: m.ReferralDashboard })));
const FeedbackManagement = lazy(() => import('@/pages/employees/FeedbackManagement').then(m => ({ default: m.FeedbackManagement })));
const ExitProcess = lazy(() => import('@/pages/employees/ExitProcess').then(m => ({ default: m.ExitProcess })));
const AttendanceReports = lazy(() => import('@/pages/employees/AttendanceReports').then(m => ({ default: m.AttendanceReports })));
const ProjectManagement = lazy(() => import('@/pages/employees/ProjectManagement').then(m => ({ default: m.ProjectManagement })));
const GrievanceDashboard = lazy(() => import('@/pages/grievance/GrievanceDashboard').then(m => ({ default: m.GrievanceDashboard })));
const AllComplaints = lazy(() => import('@/pages/grievance/AllComplaints').then(m => ({ default: m.AllComplaints })));
const BDDashboard = lazy(() => import('@/pages/bd/BDDashboard').then(m => ({ default: m.BDDashboard })));
const AllBillings = lazy(() => import('@/pages/bd/AllBillings').then(m => ({ default: m.AllBillings })));
const AllInvoices = lazy(() => import('@/pages/bd/AllInvoices').then(m => ({ default: m.AllInvoices })));
const BillingLogs = lazy(() => import('@/pages/bd/BillingLogs').then(m => ({ default: m.BillingLogs })));
const FinanceDashboard = lazy(() => import('@/pages/finance/FinanceDashboard').then(m => ({ default: m.FinanceDashboard })));
const AllPayroll = lazy(() => import('@/pages/finance/AllPayroll').then(m => ({ default: m.AllPayroll })));
const AllBilling = lazy(() => import('@/pages/finance/AllBilling').then(m => ({ default: m.AllBilling })));
const PayrollLogs = lazy(() => import('@/pages/finance/PayrollLogs').then(m => ({ default: m.PayrollLogs })));
const ATSDashboard = lazy(() => import('@/pages/ats/ATSDashboard').then(m => ({ default: m.ATSDashboard })));
const CandidatesList = lazy(() => import('@/pages/ats/CandidatesList').then(m => ({ default: m.CandidatesList })));
const RecruitmentAssessment = lazy(() => import('@/pages/ats/RecruitmentAssessment').then(m => ({ default: m.RecruitmentAssessment })));
const QuestionBank = lazy(() => import('@/pages/ats/QuestionBank').then(m => ({ default: m.QuestionBank })));
const LMSDashboard = lazy(() => import('@/pages/lms/LMSDashboard').then(m => ({ default: m.LMSDashboard })));
const Prerequisites = lazy(() => import('@/pages/lms/Prerequisites').then(m => ({ default: m.Prerequisites })));
const DocumentUpload = lazy(() => import('@/pages/lms/DocumentUpload').then(m => ({ default: m.DocumentUpload })));
const AllCandidates = lazy(() => import('@/pages/lms/AllCandidates'));
const ExitDashboard = lazy(() => import('@/pages/exit/ExitDashboard').then(m => ({ default: m.ExitDashboard })));
const ExitDocuments = lazy(() => import('@/pages/exit/ExitDocuments').then(m => ({ default: m.ExitDocuments })));
const ExitClearance = lazy(() => import('@/pages/exit/ExitClearance').then(m => ({ default: m.ExitClearance })));
const ExitInterview = lazy(() => import('@/pages/exit/ExitInterview').then(m => ({ default: m.ExitInterview })));
const NotificationsPage = lazy(() => import('@/pages/notifications/Notifications').then(m => ({ default: m.NotificationsPage })));
const PolicyDashboard = lazy(() => import('@/pages/policies/PolicyDashboard').then(m => ({ default: m.PolicyDashboard })));

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Helper function to wrap routes with RouteGuard
function GuardedRoute({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <Suspense fallback={<LoadingSpinner size="lg" />}>
        {children}
      </Suspense>
    </RouteGuard>
  );
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route 
        path="/login" 
        element={user ? <Navigate to="/dashboard" replace /> : <LoginForm />} 
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={
          <GuardedRoute>
            <DashboardOverview />
          </GuardedRoute>
        } />
        <Route path="dashboard/leave" element={
          <GuardedRoute>
            <LeaveApplication />
          </GuardedRoute>
        } />
        <Route path="dashboard/assets" element={
          <GuardedRoute>
            <Assets />
          </GuardedRoute>
        } />
        <Route path="dashboard/documents" element={
          <GuardedRoute>
            <Documents />
          </GuardedRoute>
        } />
        <Route path="dashboard/policies" element={
          <GuardedRoute>
            <Policies />
          </GuardedRoute>
        } />
        <Route path="dashboard/complaints" element={
          <GuardedRoute>
            <Complaints />
          </GuardedRoute>
        } /> 
        <Route path="dashboard/performance" element={
          <GuardedRoute>
            <Performance />
          </GuardedRoute>
        } />
        <Route path="dashboard/feedback" element={
          <GuardedRoute>
            <HRMSFeedback />
          </GuardedRoute>
        } />
        <Route path="performance" element={
          <GuardedRoute>
            <PerformanceOverview />
          </GuardedRoute>
        } />
        <Route path="performance/kra" element={
          <GuardedRoute>
            <KRA />
          </GuardedRoute>
        } />
        <Route path="performance/kra/template/:templateId" element={
          <GuardedRoute>
            <KRATemplatePage />
          </GuardedRoute>
        } />
        <Route path="performance/kra/template/new" element={
          <GuardedRoute>
            <KRATemplatePage />
          </GuardedRoute>
        } />
        <Route path="dashboard/performance/kra/:assignmentId" element={
          <GuardedRoute>
            <MyKRAPage />
          </GuardedRoute>
        } />
        <Route path="performance/kra/manager/:assignmentId" element={
          <GuardedRoute>
            <ManagerKRAPage />
          </GuardedRoute>
        } />
        <Route path="performance/kra/details/:assignmentId" element={
          <GuardedRoute>
            <KRADetailsPage />
          </GuardedRoute>
        } />
        <Route path="dashboard/referrals" element={
          <GuardedRoute>
            <ReferSomeone />
          </GuardedRoute>
        } />
        <Route path="dashboard/settings" element={
          <GuardedRoute>
            <Settings />
          </GuardedRoute>
        } />
        <Route path="employees" element={
          <GuardedRoute>
            <EmployeeManagement />
          </GuardedRoute>
        } />
        <Route path="employees/assets" element={
          <GuardedRoute>
            <AssetManagement />
          </GuardedRoute>
        } />
        <Route path="employees/leave" element={
          <GuardedRoute>
            <LeaveManagement />
          </GuardedRoute>
        } />
        <Route path="employees/referrals" element={
          <GuardedRoute>
            <ReferralDashboard />
          </GuardedRoute>
        } />
        <Route path="employees/feedback" element={
          <GuardedRoute>
            <FeedbackManagement />
          </GuardedRoute>
        } />
        <Route path="employees/exit" element={
          <GuardedRoute>
            <ExitProcess />
          </GuardedRoute>
        } />
        <Route path="employees/attendance" element={
          <GuardedRoute>
            <AttendanceReports />
          </GuardedRoute>
        } />
        <Route path="employees/projects" element={
          <GuardedRoute>
            <ProjectManagement />
          </GuardedRoute>
        } />
        <Route path="grievance" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <GrievanceDashboard />
          </Suspense>
        } />
        <Route path="grievance/*" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <GrievanceDashboard />
          </Suspense>
        } />
        <Route path="grievance/all" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <AllComplaints />
          </Suspense>
        } />
        <Route path="bd" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <BDDashboard />
          </Suspense>
        } />
        <Route path="bd/*" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <BDDashboard />
          </Suspense>
        } />
        <Route path="bd/billing" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <AllBillings />
          </Suspense>
        } />
        <Route path="bd/invoices" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <AllInvoices />
          </Suspense>
        } />
        <Route path="bd/logs" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <BillingLogs />
          </Suspense>
        } />
        <Route path="finance" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <FinanceDashboard />
          </Suspense>
        } />
        <Route path="finance/*" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <FinanceDashboard />
          </Suspense>
        } />
        <Route path="finance/payroll" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <AllPayroll />
          </Suspense>
        } />
        <Route path="finance/billing" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <AllBilling />
          </Suspense>
        } />
        <Route path="finance/logs" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <PayrollLogs />
          </Suspense>
        } /> 
        <Route path="ats" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <ATSDashboard />
          </Suspense>
        } />
        <Route path="ats/*" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <ATSDashboard />
          </Suspense>
        } />
        <Route path="ats/candidates" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <CandidatesList />
          </Suspense>
        } />
        <Route path="ats/assessment" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <RecruitmentAssessment />
          </Suspense>
        } />
        <Route path="ats/questions" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <QuestionBank />
          </Suspense>
        } />
        <Route path="lms" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <LMSDashboard />
          </Suspense>
        } />
        <Route path="lms/*" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <LMSDashboard />
          </Suspense>
        } />
        <Route path="lms/prerequisites" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <Prerequisites />
          </Suspense>
        } />
        <Route path="lms/documents" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <DocumentUpload />
          </Suspense>
        } />
        <Route path="lms/candidates" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <AllCandidates />
          </Suspense>
        } />
        <Route path="notifications" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <NotificationsPage />
          </Suspense>
        } />
        <Route path="policies" element={
          <GuardedRoute>
            <PolicyDashboard />
          </GuardedRoute>
        } />
        <Route path="policies/logs" element={
          <GuardedRoute>
            <PolicyDashboard />
          </GuardedRoute>
        } />
        {/* <Route path="policies/permissions" element={
          <GuardedRoute>
            <PolicyDashboard />
          </GuardedRoute>
        } /> */}
        <Route path="exit" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <ExitDashboard />
          </Suspense>
        } />
        <Route path="exit/*" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <ExitDashboard />
          </Suspense>
        } />
        <Route path="exit/documents" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <ExitDocuments />
          </Suspense>
        } />
        <Route path="exit/clearance" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <ExitClearance />
          </Suspense>
        } />
        <Route path="exit/interview" element={
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <ExitInterview />
          </Suspense>
        } />
        <Route path="" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AppRoutes />
          <Toaster position="top-right" />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

// Initialize print blocking after everything is mounted
function InitializePrintBlocking() {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    
    // Check if print blocking is enabled
    const isPrintBlockingEnabled = import.meta.env.VITE_ENABLE_PRINT_BLOCKING !== 'false';
    
    if (isPrintBlockingEnabled) {
      // Add CSS class to enable print blocking styles
      document.body.classList.add('print-blocking-enabled');
    }
    
    // Wait for Toaster to be fully mounted before initializing print blocking
    const timer = setTimeout(() => {
      cleanup = blockPrinting();
      initializePrintBlocking();
    }, 500);

    return () => {
      clearTimeout(timer);
      cleanup?.();
      // Remove CSS class on cleanup
      document.body.classList.remove('print-blocking-enabled');
    };
  }, []);

  return null;
}

// Wrap the original App to add print blocking
function AppWithPrintBlocking() {
  return (
    <>
      <App />
      <InitializePrintBlocking />
    </>
  );
}

export default AppWithPrintBlocking;